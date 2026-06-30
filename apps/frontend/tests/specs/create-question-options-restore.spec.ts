/**
 * fineSTEM E2E 测试 - 创造页问题选项恢复
 *
 * 用途：验证历史聊天中的 AI 选项内容在 /create 恢复后，能正确还原为 QuestionCard，
 * 且按钮与对话内容保持一致。
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const RESTORE_SETTLE_MS = 3500;

async function createProject(page: Page, token: string, name: string): Promise<ProjectRecord> {
  const response = await page.request.post(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, mode: 'standard' },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectRecord>;
  return body.data;
}

async function saveProjectChat(page: Page, token: string, projectId: string, messages: ChatMessage[]): Promise<void> {
  const response = await page.request.post(`${API_BASE}/projects/${projectId}/chat`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { messages },
  });
  expect(response.ok()).toBeTruthy();
}

async function openProjectFromSidebar(page: Page, projectName: string): Promise<void> {
  const projectItem = page.locator('div.cursor-pointer').filter({ hasText: `📍 ${projectName}` }).first();
  await expect(projectItem).toBeVisible({ timeout: 15000 });
  await projectItem.click();
  await page.waitForTimeout(RESTORE_SETTLE_MS);
}

async function assertQuestionCard(page: Page, title: string, optionLabels: string[]): Promise<void> {
  const questionCard = page.locator('div.my-3.rounded-xl').last();
  await expect(questionCard).toBeVisible({ timeout: 15000 });
  await expect(questionCard).toContainText(title);
  for (const label of optionLabels) {
    await expect(questionCard).toContainText(label);
  }
}

test.describe('创造页问题选项恢复', () => {
  test('恢复 AskUserQuestion JSON 后显示与正文一致的选项按钮', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectName = `问题恢复_JSON_${timestamp}`;
    const project = await createProject(authenticatedPage, testUser.token, projectName);

    await saveProjectChat(authenticatedPage, testUser.token, project.id, [
      { id: `user-${timestamp}`, role: 'user', content: '我想做一个帮助同学复习的项目。' },
      {
        id: `assistant-${timestamp}`,
        role: 'assistant',
        content: `我先帮你确认目标用户，再继续收敛功能。

\`\`\`json
{
  "questions": [{
    "question": "目标用户是谁？",
    "header": "用户",
    "options": [
      {"label": "我自己", "description": "先解决我自己的复习问题"},
      {"label": "同学/朋友", "description": "帮助身边的人一起复习"},
      {"label": "特定群体", "description": "比如初中生或高一新生"}
    ],
    "multiSelect": false
  }]
}
\`\`\``,
      },
    ]);

    await authenticatedPage.goto('/create');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    await openProjectFromSidebar(authenticatedPage, projectName);
    await expect(authenticatedPage.locator('body')).toContainText('我先帮你确认目标用户');
    await assertQuestionCard(authenticatedPage, '目标用户是谁？', ['我自己', '同学/朋友', '特定群体']);
  });

  test('恢复正文编号列表后显示与正文一致的选项按钮', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectName = `问题恢复_LIST_${timestamp}`;
    const project = await createProject(authenticatedPage, testUser.token, projectName);

    await saveProjectChat(authenticatedPage, testUser.token, project.id, [
      { id: `user-${timestamp}`, role: 'user', content: '我想做一个和成绩管理有关的网页。' },
      {
        id: `assistant-${timestamp}`,
        role: 'assistant',
        content: `根据你刚才的想法，我先给你三个可行方向。

下面这三个方向里，你更想先做哪一个？
1. 成绩分析仪表盘：查看平均分、最高分和趋势变化
2. 作业提醒助手：记录截止时间并提醒快到期任务
3. 错题整理工具：按学科归类错题并支持复习回顾`,
      },
    ]);

    await authenticatedPage.goto('/create');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    await openProjectFromSidebar(authenticatedPage, projectName);
    await expect(authenticatedPage.locator('body')).toContainText('根据你刚才的想法，我先给你三个可行方向');
    await assertQuestionCard(authenticatedPage, '下面这三个方向里，你更想先做哪一个？', [
      '成绩分析仪表盘',
      '作业提醒助手',
      '错题整理工具',
    ]);
  });
});
