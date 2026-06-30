/**
 * fineSTEM E2E 测试 - 创造页设计开发与运行预览
 *
 * 用途：验证历史项目恢复到编辑器后，可以运行代码并在预览区看到可运行作品
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import type { Page } from '@playwright/test';
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

const PREVIEW_TIMEOUT_MS = 10000;

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

test.describe('创造页设计开发与运行预览', () => {
  test('恢复到编辑器后的 HTML 项目可以运行并显示预览内容', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectName = `设计开发预览_${timestamp}`;
    const project = await createProject(authenticatedPage, testUser.token, projectName);
    const previewMarker = `preview-marker-${timestamp}`;
    const htmlCode = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${previewMarker}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f0fdfa; color: #134e4a; padding: 24px; }
    .card { border-radius: 12px; background: white; padding: 20px; box-shadow: 0 8px 24px rgba(15, 118, 110, 0.12); }
  </style>
</head>
<body>
  <main class="card">
    <h1>${previewMarker}</h1>
    <p>这是设计开发阶段的可运行作品预览。</p>
  </main>
</body>
</html>`;

    await saveProjectCode(authenticatedPage, testUser.token, project.id, htmlCode, 'html');

    await authenticatedPage.goto('/create');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    const projectItem = authenticatedPage.locator('div.cursor-pointer').filter({ hasText: `📍 ${projectName}` }).first();
    const workspaceResponse = authenticatedPage.waitForResponse((response) => {
      return (
        response.request().method() === 'GET' &&
        response.url().endsWith(`/projects/${project.id}/workspace`) &&
        response.status() === 200
      );
    });

    await expect(projectItem).toBeVisible();
    await projectItem.click();
    await workspaceResponse;

    await expect(
      authenticatedPage.locator('div.text-teal-700.font-medium').filter({ hasText: `📍 ${projectName}` }).first(),
    ).toBeVisible();
    await expect
      .poll(async () => getMonacoValue(authenticatedPage), {
        timeout: PREVIEW_TIMEOUT_MS,
        message: '等待历史项目代码恢复到编辑器',
      })
      .toContain(previewMarker);

    await authenticatedPage.getByRole('button', { name: '运行', exact: true }).click();
    await expect(authenticatedPage.getByRole('button', { name: '预览', exact: true })).toBeVisible();

    const previewFrame = authenticatedPage.locator('iframe[title="运行结果"]').first().contentFrame();
    await expect(previewFrame.locator('body')).toContainText(previewMarker, { timeout: PREVIEW_TIMEOUT_MS });
    await expect(previewFrame.locator('body')).toContainText('这是设计开发阶段的可运行作品预览。', {
      timeout: PREVIEW_TIMEOUT_MS,
    });
  });
});
