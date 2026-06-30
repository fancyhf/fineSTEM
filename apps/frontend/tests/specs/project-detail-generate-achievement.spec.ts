/**
 * fineSTEM E2E 测试 - 项目详情页直接生成成果档案卡
 *
 * 用途：验证“生成成果档案卡”按钮会真实创建成果卡，而不是只跳到对话流
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import { test, expect, API_BASE } from '../fixtures';

interface ProjectRecord {
  id: string;
  name: string;
  mode: string;
}

interface AchievementCardRecord {
  id: string;
  title: string;
  project_id: string;
}

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

async function createProject(
  authenticatedPage: import('@playwright/test').Page,
  token: string,
  name: string,
): Promise<ProjectRecord> {
  const response = await authenticatedPage.request.post(`${API_BASE}/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name,
      mode: 'standard',
      description: '用于验证项目详情页直接生成成果档案卡',
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectRecord>;
  return body.data;
}

test.describe('项目详情页直接生成成果档案卡', () => {
  test('点击生成成果档案卡后会真实创建记录并跳转成果页', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectName = `成果卡直生_${timestamp}`;
    const project = await createProject(authenticatedPage, testUser.token, projectName);

    await authenticatedPage.goto(`/research/projects/${project.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await expect(authenticatedPage.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 15000 });
    await expect(authenticatedPage.getByRole('button', { name: '生成成果档案卡' })).toBeVisible();

    const generateResponse = authenticatedPage.waitForResponse((response) => {
      return response.request().method() === 'POST'
        && response.url().endsWith(`/projects/${project.id}/achievement-generate`)
        && response.status() === 200;
    });

    await authenticatedPage.getByRole('button', { name: '生成成果档案卡' }).click();
    await generateResponse;
    await authenticatedPage.waitForURL(new RegExp(`/research/projects/${project.id}/achievement`));

    await expect(authenticatedPage.locator('body')).toContainText(projectName);

    const cardResponse = await authenticatedPage.request.get(`${API_BASE}/achievement-cards/projects/${project.id}`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
    });

    expect(cardResponse.ok()).toBeTruthy();
    const cardBody = (await cardResponse.json()) as ApiEnvelope<AchievementCardRecord | null>;
    expect(cardBody.data?.project_id).toBe(project.id);
    expect(cardBody.data?.title).toBe(projectName);
  });
});
