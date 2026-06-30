/**
 * fineSTEM E2E 测试 - 阶段8页面回填
 *
 * 用途：验证旧式标准项目只有 evaluate 工件、没有 step8.payload 时，
 * 打开项目详情页仍能正确回填阶段8三个文本框，并支持“让 AI 协助本阶段”。
 *
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

async function createStandardProject(page: Page, token: string, name: string): Promise<ProjectRecord> {
  const response = await page.request.post(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, mode: 'standard' },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectRecord>;
  return body.data;
}

async function drivePblStages(
  page: Page,
  token: string,
  projectId: string,
  stages: Array<{ stage: string; artifact: string; content: string }>,
): Promise<void> {
  for (const { stage, artifact, content } of stages) {
    const response = await page.request.post(`${API_BASE}/projects/${projectId}/pbl/complete-stage`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { stage, artifacts: { [artifact]: content } },
    });
    expect(response.ok(), `阶段 ${stage} 推进失败`).toBeTruthy();
  }
}

test.describe('阶段8页面回填', () => {
  test('旧式 evaluate 工件也能回填阶段8文本框，并支持 AI 协助', async ({ authenticatedPage, testUser }) => {
    const projectName = `阶段8回填_${Date.now()}`;
    const project = await createStandardProject(authenticatedPage, testUser.token, projectName);

    await drivePblStages(authenticatedPage, testUser.token, project.id, [
      { stage: 'stage_01_brainstorm', artifact: 'brainstorm', content: '# 脑爆' },
      { stage: 'stage_02_brief', artifact: 'project_brief', content: '# 简介' },
      { stage: 'stage_03_constraints', artifact: 'constraints', content: '# 约束' },
      { stage: 'stage_04_track', artifact: 'track_plan', content: '# 轨道' },
      { stage: 'stage_05_design', artifact: 'design', content: '# 设计' },
      { stage: 'stage_06_step_plan', artifact: 'step_plan', content: '# 计划' },
      { stage: 'stage_07_execute', artifact: 'dev_log', content: '# 日志' },
      {
        stage: 'stage_08_evaluate',
        artifact: 'evaluate',
        content: [
          '## 验收总结',
          '项目已经完成核心功能验证，并通过了当前验收检查。',
          '',
          '## 学习反思',
          '这次我学会了把分阶段材料整理成完整的项目总结。',
          '',
          '## 下一轮迭代',
          '下一轮我会继续补充展示细节和操作说明。',
        ].join('\n'),
      },
    ]);

    await authenticatedPage.goto(`/research/projects/${project.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await expect(authenticatedPage.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 15000 });

    const textareas = authenticatedPage.locator('textarea');
    await expect(textareas.nth(0)).toHaveValue(/核心功能验证/);
    await expect(textareas.nth(1)).toHaveValue(/整理成完整的项目总结/);
    await expect(textareas.nth(2)).toHaveValue(/补充展示细节和操作说明/);

    const assistResponse = authenticatedPage.waitForResponse((response) => {
      return response.request().method() === 'POST'
        && response.url().endsWith(`/projects/${project.id}/achievement-generate`)
        && response.status() === 200;
    });
    await authenticatedPage.getByRole('button', { name: '让 AI 协助本阶段' }).click();
    await assistResponse;

    await expect(authenticatedPage.locator('body')).toContainText('已根据当前项目材料生成成果档案卡，并回填到评估展示阶段。');
    await expect(textareas.nth(0)).toHaveValue(/核心功能验证|一句话介绍/);
    await expect(authenticatedPage).toHaveURL(new RegExp(`/research/projects/${project.id}$`));
  });
});
