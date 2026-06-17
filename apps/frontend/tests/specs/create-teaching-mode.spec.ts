/**
 * fineSTEM E2E 测试 - 创造页教学模式切换
 *
 * 用途：验证 stage_07/stage_08 下可切换教学模式，并持久化到项目进度
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import type { Page } from '@playwright/test';
import { test, expect, API_BASE } from '../fixtures';

interface ProjectRecord {
  id: string;
  name: string;
  mode: string;
}

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

async function createProject(page: Page, token: string, name: string): Promise<ProjectRecord> {
  const response = await page.request.post(`${API_BASE}/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name,
      mode: 'standard',
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectRecord>;
  return body.data;
}

async function advanceToExecuteStage(page: Page, token: string, projectId: string): Promise<void> {
  // 使用 /pbl/complete-stage 逐阶段写入工件并推进（带门禁）
  const stages = [
    { stage: 'stage_01_brainstorm', artifact: 'brainstorm', content: '# 脑爆\n测试项目' },
    { stage: 'stage_02_brief', artifact: 'project_brief', content: '# 项目简介\n教学模式测试' },
    { stage: 'stage_03_constraints', artifact: 'constraints', content: '# 约束\n无特殊约束' },
    { stage: 'stage_04_track', artifact: 'track_plan', content: '# 轨道\nWeb 应用' },
    { stage: 'stage_05_design', artifact: 'design', content: '# 设计\n前端设计' },
    { stage: 'stage_06_step_plan', artifact: 'step_plan', content: '# 分步\nStep1 初始化' },
    { stage: 'stage_07_execute', artifact: 'dev_log', content: '# 开发日志\nDay1 开始' },
  ];
  for (const { stage, artifact, content } of stages) {
    const response = await page.request.post(`${API_BASE}/projects/${projectId}/pbl/complete-stage`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { stage, artifacts: { [artifact]: content } },
    });
    expect(response.ok()).toBeTruthy();
  }
}

test.describe('创造页教学模式切换', () => {
  test('在执行阶段可以切换四种教学模式并持久化', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectName = `教学模式回归_${timestamp}`;
    const project = await createProject(authenticatedPage, testUser.token, projectName);
    await advanceToExecuteStage(authenticatedPage, testUser.token, project.id);

    await authenticatedPage.goto('/create');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    const projectItem = authenticatedPage.locator('div.cursor-pointer').filter({ hasText: `📍 ${projectName}` }).first();
    await expect(projectItem).toBeVisible();
    await projectItem.click();

    await expect(authenticatedPage.locator('body')).toContainText('教学模式');
    const modeCases = [
      { label: '引导式', value: 'guided' },
      { label: '演示式', value: 'demo' },
      { label: '动手式', value: 'hands_on' },
      { label: '讲解式', value: 'lecture' },
    ] as const;

    for (const modeCase of modeCases) {
      const switchResponse = authenticatedPage.waitForResponse((response) => {
        return (
          response.request().method() === 'POST' &&
          response.url().endsWith(`/projects/${project.id}/teaching-mode`) &&
          response.status() === 200
        );
      });

      await authenticatedPage.getByRole('button', { name: new RegExp(modeCase.label) }).click();
      await switchResponse;
      await expect(authenticatedPage.locator('body')).toContainText(`已切换到${modeCase.label}`);

      const progressResponse = await authenticatedPage.request.get(`${API_BASE}/projects/${project.id}/progress`, {
        headers: {
          Authorization: `Bearer ${testUser.token}`,
        },
      });
      expect(progressResponse.ok()).toBeTruthy();

      const progressBody = (await progressResponse.json()) as ApiEnvelope<{ teaching_mode?: string }>;
      expect(progressBody.data.teaching_mode).toBe(modeCase.value);
    }
  });
});
