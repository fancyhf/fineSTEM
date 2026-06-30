/**
 * fineSTEM E2E 测试 - 项目详情页成果卡草稿
 *
 * 用途：验证项目详情页能识别成果卡草稿，并跳转到成果卡页面完成确认保存
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
      description: '用于验证成果卡草稿识别与保存入口',
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectRecord>;
  return body.data;
}

async function saveChatHistory(page: Page, token: string, projectId: string, content: string): Promise<void> {
  const response = await page.request.post(`${API_BASE}/projects/${projectId}/chat`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      messages: [
        { role: 'user', content: '请帮我总结这个项目' },
        { role: 'assistant', content },
      ],
    },
  });

  expect(response.ok()).toBeTruthy();
}

test.describe('项目详情页成果卡草稿', () => {
  test('能从聊天记录识别成果卡草稿，并进入确认保存页', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectName = `成果卡草稿回归_${timestamp}`;
    const project = await createProject(authenticatedPage, testUser.token, projectName);

    await saveChatHistory(
      authenticatedPage,
      testUser.token,
      project.id,
      [
        `项目名称：${projectName}`,
        '一句话介绍：这是一个通过聊天记录整理成果卡草稿的项目。',
        '解决了什么问题：我把评估验收阶段的总结重新整理清楚了。',
        '用了什么方法：结合项目文档和历史对话提炼成果信息。',
        '反思：后续还可以补充更多验收截图和复盘内容。',
      ].join('\n'),
    );

    await authenticatedPage.goto(`/research/projects/${project.id}`);
    await authenticatedPage.waitForLoadState('domcontentloaded');

    await expect(authenticatedPage.getByRole('button', { name: '查看成果卡草稿' })).toBeVisible();
    await expect(authenticatedPage.locator('body')).toContainText('有草稿待确认保存');

    await authenticatedPage.getByRole('button', { name: '查看成果卡草稿' }).click();
    await authenticatedPage.waitForURL(new RegExp(`/research/projects/${project.id}/achievement`));

    await expect(authenticatedPage.locator('body')).toContainText('从工作台对话中提取');
    await expect(authenticatedPage.getByRole('button', { name: '确认保存到成果卡' })).toBeVisible();
  });
});
