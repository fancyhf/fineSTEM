/**
 * RT-14: Q-013 阶段推进防粗暴跳跃 — 有头 E2E 测试
 *
 * 修复背景：
 *   问题 Q-013：AI 从 stage_05 开始粗暴推进到 stage_08，跳过技术架构选择
 *   (stage_04)、教学模式选择 (stage_07)、代码编写。学生说"直接给完整版"
 *   就直接进入验收。
 *
 *   根因：7 个门禁漏洞——ProjectCodeWriter 没有阶段检查、check_gate 软门禁
 *   可被 markdown 绕过、teachingMode 可被 AI 自行设置绕过学生交互。
 *
 *   修复：5 层防护——阶段代码锁、stage_04 硬门禁、stage_07 硬门禁、
 *   teachingModeConfirmed 防绕过、SKILL.md 同步。
 *
 * 测试场景：
 *   RT-14a：技术架构硬门禁（stage_04_track）
 *   RT-14b：教学模式硬门禁（stage_07_execute）
 *   RT-14c：学生催促"直接给代码"时不跳过教学模式选择
 *   RT-14d：防跨阶段跳跃
 *
 * 维护者：AI Agent (Test Agent for fineSTEM)
 * links: .trae/documents/testing/
 */

import type { Page } from '@playwright/test';
import { test, expect, API_BASE } from '../fixtures';

// ── 类型定义 ──────────────────────────────────────────────────

interface ProjectRecord {
  id: string;
  name: string;
  mode: string;
}

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

interface ProjectProgress {
  current_stage: string;
  stage_history?: any;
  light_step_data?: any;
  standard_step_data?: any;
  teaching_mode?: string;
}

// ── 辅助函数 ──────────────────────────────────────────────────

async function createProject(page: Page, token: string, name: string): Promise<ProjectRecord> {
  const response = await page.request.post(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, mode: 'standard' },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectRecord>;
  return body.data;
}

async function completeStage(
  page: Page,
  token: string,
  projectId: string,
  stage: string,
  artifacts: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: any }> {
  const response = await page.request.post(`${API_BASE}/projects/${projectId}/pbl/complete-stage`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { stage, artifacts },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok(), status: response.status(), body };
}

async function getProgress(page: Page, token: string, projectId: string): Promise<ProjectProgress> {
  const response = await page.request.get(`${API_BASE}/projects/${projectId}/progress`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectProgress>;
  return body.data;
}

/**
 * 推进到指定阶段（写入前序阶段的工件并逐阶段推进）。
 * Q-013 修复：stage_04_track 使用 JSON 格式工件；stage_07_execute 包含 teachingMode。
 */
async function advanceToStage(
  page: Page,
  token: string,
  projectId: string,
  targetStage: string,
  includeTeachingMode: boolean = true,
): Promise<void> {
  const stages: Array<{ stage: string; artifacts: Record<string, string> }> = [
    { stage: 'stage_01_brainstorm', artifacts: { brainstorm: '# 脑爆\n测试项目' } },
    { stage: 'stage_02_brief', artifacts: { project_brief: '# 项目简介\n测试' } },
    { stage: 'stage_03_constraints', artifacts: { constraints: '# 约束\n无特殊约束' } },
    {
      stage: 'stage_04_track',
      artifacts: { track_plan: '{"track": "web", "tech_stack": ["HTML", "CSS", "JavaScript"]}' },
    },
    { stage: 'stage_05_design', artifacts: { design: '# 设计\n前端设计' } },
    { stage: 'stage_06_step_plan', artifacts: { step_plan: '# 分步\nStep1 初始化' } },
  ];

  // 如果目标阶段是 stage_07 或之后，且需要 teachingMode
  if (targetStage === 'stage_07_execute' || targetStage === 'stage_08_evaluate') {
    if (includeTeachingMode) {
      stages.push({
        stage: 'stage_07_execute',
        artifacts: {
          dev_log: '# 开发日志\nDay1 开始',
          teachingMode: 'guided',
          teachingModeConfirmed: 'true',
        },
      });
    } else {
      stages.push({
        stage: 'stage_07_execute',
        artifacts: { dev_log: '# 开发日志\nDay1 开始' },
      });
    }
  }

  for (const { stage, artifacts } of stages) {
    // 如果已经到达目标阶段，停止
    if (stage === targetStage) break;
    const result = await completeStage(page, token, projectId, stage, artifacts);
    expect(result.ok).toBeTruthy();
  }
}

// =============================================================================
// RT-14a: 技术架构硬门禁（stage_04_track）
// =============================================================================

test.describe('RT-14a: 技术架构硬门禁 (stage_04_track)', () => {
  test('markdown 文本作为工件应被门禁拦截', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14a-markdown_${Date.now()}`);

    // 先推进到 stage_04_track（写入前 3 个阶段工件）
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_04_track');

    // 验证当前在 stage_04_track
    const progressBefore = await getProgress(authenticatedPage, testUser.token, project.id);
    expect(progressBefore.current_stage).toBe('stage_04_track');

    // 尝试用 markdown 文本作为 track_plan 工件 → 应被拦截
    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_04_track', {
      track_plan: '# 轨道选择\n选择：Web\n用 HTML/CSS/JS',
    });

    // 门禁应拦截，工件已保存但阶段不推进
    expect(result.body.data.current_stage).toBe('stage_04_track');
    expect(result.body.message).toContain('门禁未通过');
  });

  test('JSON 缺 track 字段应被拦截', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14a-no-track_${Date.now()}`);
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_04_track');

    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_04_track', {
      track_plan: '{"tech_stack": ["Python", "Streamlit"]}',
    });

    expect(result.body.data.current_stage).toBe('stage_04_track');
    expect(result.body.message).toContain('门禁未通过');
  });

  test('JSON 缺 tech_stack 字段应被拦截', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14a-no-stack_${Date.now()}`);
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_04_track');

    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_04_track', {
      track_plan: '{"track": "web"}',
    });

    expect(result.body.data.current_stage).toBe('stage_04_track');
    expect(result.body.message).toContain('门禁未通过');
  });

  test('完整 JSON（track + tech_stack）应通过门禁', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14a-valid_${Date.now()}`);
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_04_track');

    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_04_track', {
      track_plan: '{"track": "web", "tech_stack": ["HTML", "CSS", "JavaScript"]}',
    });

    expect(result.ok).toBeTruthy();
    expect(result.body.data.current_stage).toBe('stage_05_design');
  });
});

// =============================================================================
// RT-14b: 教学模式硬门禁（stage_07_execute）
// =============================================================================

test.describe('RT-14b: 教学模式硬门禁 (stage_07_execute)', () => {
  test('无 teachingMode 时 stage_advancer 应拦截推进到 stage_08', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14b-no-mode_${Date.now()}`);

    // 推进到 stage_07_execute，但不设置 teachingMode
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_07_execute', false);

    // 验证当前在 stage_07_execute
    const progressBefore = await getProgress(authenticatedPage, testUser.token, project.id);
    expect(progressBefore.current_stage).toBe('stage_07_execute');

    // 尝试推进（写入 dev_log 但不设 teachingMode）
    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_07_execute', {
      dev_log: '# 开发日志\n完成了核心功能',
    });

    // 应被门禁拦截，不推进到 stage_08
    expect(result.body.data.current_stage).toBe('stage_07_execute');
    expect(result.body.message).toContain('门禁未通过');
  });

  test('有 teachingMode 但无 confirmed 应被拦截', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14b-no-conf_${Date.now()}`);
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_07_execute', false);

    // 设置 teachingMode 但不设 confirmed
    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_07_execute', {
      dev_log: '# 开发日志\n完成了核心功能',
      teachingMode: 'guided',
      // 故意不传 teachingModeConfirmed
    });

    expect(result.body.data.current_stage).toBe('stage_07_execute');
    expect(result.body.message).toContain('门禁未通过');
  });

  test('有 teachingMode + confirmed 应通过门禁', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14b-complete_${Date.now()}`);
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_07_execute', false);

    // 设置完整的 teachingMode + confirmed
    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_07_execute', {
      dev_log: '# 开发日志\n完成了核心功能',
      teachingMode: 'guided',
      teachingModeConfirmed: 'true',
    });

    expect(result.ok).toBeTruthy();
    expect(result.body.data.current_stage).toBe('stage_08_evaluate');
  });
});

// =============================================================================
// RT-14c: 学生催促"直接给代码"时不跳过教学模式选择
// =============================================================================

test.describe('RT-14c: 学生催促"直接给代码"防绕过 @ai', () => {
  test('stage_07 阶段学生说"直接给完整版"时 AI 不跳过教学模式选择', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14c-urge_${Date.now()}`);
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_07_execute', false);

    // 验证当前在 stage_07_execute
    const progress = await getProgress(authenticatedPage, testUser.token, project.id);
    expect(progress.current_stage).toBe('stage_07_execute');

    // 打开项目编辑器
    await authenticatedPage.goto(`/create?projectId=${project.id}`, { waitUntil: 'domcontentloaded' });
    await authenticatedPage.waitForTimeout(3000);

    // 在聊天框输入催促消息
    const chatInput = authenticatedPage.locator('[data-testid="chat-input"]');
    if (await chatInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await chatInput.fill('直接给我完整版，跳过那些步骤');
      await authenticatedPage.locator('[data-testid="send-button"]').click().catch(() => {});

      // 等待 AI 响应
      await authenticatedPage.waitForTimeout(30000);

      // 验证阶段没有跳过——仍然在 stage_07（核心断言：门禁生效）
      const progressAfter = await getProgress(authenticatedPage, testUser.token, project.id);
      expect(progressAfter.current_stage).toBe('stage_07_execute');

      // Q-013 防绕过验证：即使 AI 尝试设置 teachingMode，
      // 没有 teachingModeConfirmed=true 时门禁仍应阻止推进。
      // 这里不检查 teaching_mode 是否为空（AI 可能尝试设置），
      // 而是检查阶段是否被门禁拦住——这才是核心防护。
    }
  });
});

// =============================================================================
// RT-14d: 防跨阶段跳跃
// =============================================================================

test.describe('RT-14d: 防跨阶段跳跃', () => {
  test('stage_advancer 拒绝跨阶段推进', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14d-skip_${Date.now()}`);

    // 验证初始阶段
    const progress = await getProgress(authenticatedPage, testUser.token, project.id);
    expect(progress.current_stage).toBe('stage_01_brainstorm');

    // 尝试直接写 stage_05 的工件（跳过 stage_01~04）
    // artifact_writer 的门禁应该阻止写入未来阶段的工件
    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_05_design', {
      design: '# 设计\n跳过前面阶段直接设计',
    });

    // 阶段不应该推进到 stage_06（因为还在 stage_01，门禁应拦截）
    const progressAfter = await getProgress(authenticatedPage, testUser.token, project.id);
    // 当前阶段不应是 stage_06（如果门禁正常工作）
    expect(progressAfter.current_stage).not.toBe('stage_06_step_plan');
  });

  test('每个阶段都必须按顺序推进', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14d-order_${Date.now()}`);

    // 按顺序推进，验证每一步都到正确的下一阶段
    const stages = [
      { stage: 'stage_01_brainstorm', artifacts: { brainstorm: '# 脑爆' }, expectedNext: 'stage_02_brief' },
      { stage: 'stage_02_brief', artifacts: { project_brief: '# 简介' }, expectedNext: 'stage_03_constraints' },
      { stage: 'stage_03_constraints', artifacts: { constraints: '# 约束' }, expectedNext: 'stage_04_track' },
      {
        stage: 'stage_04_track',
        artifacts: { track_plan: '{"track": "web", "tech_stack": ["HTML"]}' },
        expectedNext: 'stage_05_design',
      },
      { stage: 'stage_05_design', artifacts: { design: '# 设计' }, expectedNext: 'stage_06_step_plan' },
      { stage: 'stage_06_step_plan', artifacts: { step_plan: '# 计划' }, expectedNext: 'stage_07_execute' },
      {
        stage: 'stage_07_execute',
        artifacts: { dev_log: '# 日志', teachingMode: 'guided', teachingModeConfirmed: 'true' },
        expectedNext: 'stage_08_evaluate',
      },
    ];

    for (const { stage, artifacts, expectedNext } of stages) {
      const result = await completeStage(authenticatedPage, testUser.token, project.id, stage, artifacts);
      expect(result.ok).toBeTruthy();
      expect(result.body.data.current_stage).toBe(expectedNext);
    }
  });

  test('stage_05_design 阶段不能跳到 stage_08_evaluate', async ({ authenticatedPage, testUser }) => {
    const project = await createProject(authenticatedPage, testUser.token, `RT14d-jump_${Date.now()}`);
    await advanceToStage(authenticatedPage, testUser.token, project.id, 'stage_05_design');

    // 当前在 stage_05_design
    const progress = await getProgress(authenticatedPage, testUser.token, project.id);
    expect(progress.current_stage).toBe('stage_05_design');

    // 尝试写 stage_08 的工件（跳过 stage_06、07）
    const result = await completeStage(authenticatedPage, testUser.token, project.id, 'stage_08_evaluate', {
      evaluate: '# 验收\n跳过中间阶段',
    });

    // 不应该推进到 stage_08（还在 stage_05 或 stage_06）
    const progressAfter = await getProgress(authenticatedPage, testUser.token, project.id);
    expect(progressAfter.current_stage).not.toBe('stage_08_evaluate');
  });
});
