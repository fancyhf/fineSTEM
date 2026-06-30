/**
 * fineSTEM E2E 测试 - 创造页历史项目恢复
 *
 * 用途：验证历史项目切换时会恢复聊天与代码，且不会在恢复后立刻被自动保存覆盖
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import type { Page, Request } from '@playwright/test';
import { test, expect, API_BASE } from '../fixtures';

interface ProjectRecord {
  id: string;
  name: string;
  mode: string;
  current_stage?: string;
}

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

interface WorkspacePayload {
  workspace?: {
    code?: string;
    language?: string;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const RESTORE_SETTLE_MS = 3500;

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

async function saveProjectChat(
  page: Page,
  token: string,
  projectId: string,
  messages: ChatMessage[],
): Promise<void> {
  const response = await page.request.post(`${API_BASE}/projects/${projectId}/chat`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      messages,
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function saveProjectCode(
  page: Page,
  token: string,
  projectId: string,
  code: string,
  language: string,
): Promise<void> {
  const response = await page.request.post(`${API_BASE}/projects/${projectId}/code`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      code,
      language,
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function getMonacoValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    type MonacoModel = { getValue: () => string };
    type MonacoEditor = { getModels?: () => MonacoModel[] };
    type MonacoNamespace = { editor?: MonacoEditor };

    const browserWindow = window as Window & { monaco?: MonacoNamespace };
    const model = browserWindow.monaco?.editor?.getModels?.()?.[0];
    return model?.getValue() ?? '';
  });
}

async function openProjectAndAssertRestore(
  page: Page,
  project: ProjectRecord,
  expectedChatMarker: string,
  expectedCodeMarker: string,
): Promise<void> {
  const unexpectedRestorePosts: string[] = [];
  const captureUnexpectedPost = (request: Request) => {
    const requestUrl = request.url();
    if (
      request.method() === 'POST' &&
      (requestUrl.endsWith(`/projects/${project.id}/chat`) || requestUrl.endsWith(`/projects/${project.id}/code`))
    ) {
      unexpectedRestorePosts.push(`${request.method()} ${requestUrl}`);
    }
  };

  page.on('request', captureUnexpectedPost);

  try {
    const projectItem = page.locator('div.cursor-pointer').filter({ hasText: `📍 ${project.name}` }).first();
    const workspaceResponse = page.waitForResponse((response) => {
      return (
        response.request().method() === 'GET' &&
        response.url().endsWith(`/projects/${project.id}/workspace`) &&
        response.status() === 200
      );
    });

    await expect(projectItem).toBeVisible();
    await projectItem.click();
    const workspaceApiResponse = await workspaceResponse;
    const workspaceBody = (await workspaceApiResponse.json()) as ApiEnvelope<WorkspacePayload>;

    await expect(
      page.locator('div.text-teal-700.font-medium').filter({ hasText: `📍 ${project.name}` }).first(),
    ).toBeVisible();
    await expect(page.locator('body')).toContainText(expectedChatMarker);
    expect(workspaceBody.data.workspace?.code || '').toContain(expectedCodeMarker);

    await page.waitForTimeout(RESTORE_SETTLE_MS);
    expect(unexpectedRestorePosts).toEqual([]);
  } finally {
    page.off('request', captureUnexpectedPost);
  }
}

test.describe('创造页历史项目恢复', () => {
  test('切换历史项目时恢复聊天和代码，且不会立刻回写覆盖', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectA = await createProject(authenticatedPage, testUser.token, `历史恢复A_${timestamp}`);
    const projectB = await createProject(authenticatedPage, testUser.token, `历史恢复B_${timestamp}`);

    const chatMarkerA = `历史聊天标记A_${timestamp}`;
    const chatMarkerB = `历史聊天标记B_${timestamp}`;
    const codeMarkerA = `restore-code-a-${timestamp}`;
    const codeMarkerB = `restore-code-b-${timestamp}`;

    await saveProjectChat(authenticatedPage, testUser.token, projectA.id, [
      { id: `user-a-${timestamp}`, role: 'user', content: '我想做一个学生成绩管理网页' },
      { id: `assistant-a-${timestamp}`, role: 'assistant', content: `这是项目 A 的历史聊天：${chatMarkerA}` },
    ]);
    await saveProjectCode(
      authenticatedPage,
      testUser.token,
      projectA.id,
      `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${codeMarkerA}</title></head>
<body><main id="app">${codeMarkerA}</main></body>
</html>`,
      'html',
    );

    await saveProjectChat(authenticatedPage, testUser.token, projectB.id, [
      { id: `user-b-${timestamp}`, role: 'user', content: '我想做一个星球运动演示' },
      { id: `assistant-b-${timestamp}`, role: 'assistant', content: `这是项目 B 的历史聊天：${chatMarkerB}` },
    ]);
    await saveProjectCode(
      authenticatedPage,
      testUser.token,
      projectB.id,
      `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${codeMarkerB}</title></head>
<body><section data-project="b">${codeMarkerB}</section></body>
</html>`,
      'html',
    );

    await authenticatedPage.goto('/create', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await expect(authenticatedPage.locator('body')).toContainText(projectA.name);
    await expect(authenticatedPage.locator('body')).toContainText(projectB.name);

    await openProjectAndAssertRestore(authenticatedPage, projectA, chatMarkerA, codeMarkerA);
    await expect(authenticatedPage.locator('body')).not.toContainText(chatMarkerB);
    await expect
      .poll(async () => getMonacoValue(authenticatedPage), {
        timeout: 5000,
        message: '确认项目 A 代码没有混入项目 B',
      })
      .not.toContain(codeMarkerB);

    await openProjectAndAssertRestore(authenticatedPage, projectB, chatMarkerB, codeMarkerB);
    await expect(authenticatedPage.locator('body')).not.toContainText(chatMarkerA);
    await expect
      .poll(async () => getMonacoValue(authenticatedPage), {
        timeout: 5000,
        message: '确认项目 B 代码已经替换掉项目 A',
      })
      .not.toContain(codeMarkerA);
  });
});
