/**
 * fineSTEM E2E 测试 - 创造页多文件保存与恢复
 *
 * 用途：验证编辑次文件后切回主文件，自动保存会带上完整 files，并在重新进入项目时恢复修改后的次文件内容
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

interface FileEntry {
  name: string;
  language: string;
  content: string;
  is_main: boolean;
}

interface WorkspacePayload {
  workspace?: {
    code?: string;
    language?: string;
    filename?: string | null;
    files?: FileEntry[];
  };
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

async function saveProjectWorkspace(
  page: Page,
  token: string,
  projectId: string,
  code: string,
  language: string,
  filename: string,
  files: FileEntry[],
): Promise<void> {
  const response = await page.request.post(`${API_BASE}/projects/${projectId}/code`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      code,
      language,
      filename,
      files,
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function fetchWorkspace(page: Page, token: string, projectId: string): Promise<WorkspacePayload> {
  const response = await page.request.get(`${API_BASE}/projects/${projectId}/workspace`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<WorkspacePayload>;
  return body.data;
}

async function getMonacoValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    type MonacoModel = { getValue: () => string; setValue: (value: string) => void };
    type MonacoEditor = { getModels?: () => MonacoModel[] };
    type MonacoNamespace = { editor?: MonacoEditor };

    const browserWindow = window as Window & { monaco?: MonacoNamespace };
    const model = browserWindow.monaco?.editor?.getModels?.()?.[0];
    return model?.getValue() ?? '';
  });
}

async function setMonacoValue(page: Page, value: string): Promise<void> {
  await page.evaluate((nextValue) => {
    type MonacoModel = { setValue: (value: string) => void };
    type MonacoEditor = { getModels?: () => MonacoModel[] };
    type MonacoNamespace = { editor?: MonacoEditor };

    const browserWindow = window as Window & { monaco?: MonacoNamespace };
    const model = browserWindow.monaco?.editor?.getModels?.()?.[0];
    model?.setValue(nextValue);
  }, value);
}

async function openProject(page: Page, project: ProjectRecord): Promise<void> {
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
  await workspaceResponse;
  await expect(
    page.locator('div.text-teal-700.font-medium').filter({ hasText: `📍 ${project.name}` }).first(),
  ).toBeVisible();
}

async function ensureFilesPanelVisible(page: Page): Promise<void> {
  const secondaryFileButton = page.getByRole('button', { name: /app\.js/ }).first();
  if (await secondaryFileButton.count()) {
    return;
  }

  const filesToggle = page.getByRole('button', { name: /项目资源|资源/ }).first();
  await expect(filesToggle).toBeVisible();
  await filesToggle.click();
  await expect(secondaryFileButton).toBeVisible();
}

test.describe('创造页多文件保存与恢复', () => {
  test('编辑次文件后切回主文件，刷新后仍恢复最新内容', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectName = `多文件恢复_${timestamp}`;
    const project = await createProject(authenticatedPage, testUser.token, projectName);

    const mainMarker = `multi-main-${timestamp}`;
    const secondaryMarker = `multi-secondary-${timestamp}`;
    const updatedSecondaryMarker = `multi-secondary-updated-${timestamp}`;

    const mainCode = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${mainMarker}</title>
</head>
<body>
  <main>${mainMarker}</main>
</body>
</html>`;
    const secondaryCode = `export const secondaryMarker = '${secondaryMarker}';
console.log(secondaryMarker);`;
    const updatedSecondaryCode = `export const secondaryMarker = '${updatedSecondaryMarker}';
console.log(secondaryMarker);
console.log('saved');`;

    await saveProjectWorkspace(
      authenticatedPage,
      testUser.token,
      project.id,
      mainCode,
      'html',
      'index.html',
      [
        { name: 'index.html', language: 'html', content: mainCode, is_main: true },
        { name: 'app.js', language: 'javascript', content: secondaryCode, is_main: false },
      ],
    );

    await authenticatedPage.goto('/create', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await expect(authenticatedPage.locator('body')).toContainText(projectName);
    await openProject(authenticatedPage, project);
    await ensureFilesPanelVisible(authenticatedPage);

    const mainFileButton = authenticatedPage.getByRole('button', { name: /index\.html/ }).first();
    const secondaryFileButton = authenticatedPage.getByRole('button', { name: /app\.js/ }).first();

    await expect(mainFileButton).toBeVisible();
    await expect(secondaryFileButton).toBeVisible();

    await secondaryFileButton.click();
    await expect
      .poll(async () => getMonacoValue(authenticatedPage), {
        timeout: 5000,
        message: '等待次文件内容进入编辑器',
      })
      .toContain(secondaryMarker);

    await setMonacoValue(authenticatedPage, updatedSecondaryCode);
    const saveResponsePromise = authenticatedPage.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().endsWith(`/projects/${project.id}/code`) &&
        response.status() === 200
      );
    }, { timeout: 10000 });
    await mainFileButton.click();
    await expect
      .poll(async () => getMonacoValue(authenticatedPage), {
        timeout: 5000,
        message: '切回主文件后应恢复主文件内容',
      })
      .toContain(mainMarker);

    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBeTruthy();

    const workspace = await fetchWorkspace(authenticatedPage, testUser.token, project.id);
    const restoredSecondaryFile = workspace.workspace?.files?.find((file) => file.name === 'app.js');
    expect(restoredSecondaryFile?.content).toContain(updatedSecondaryMarker);
    expect(workspace.workspace?.filename).toBe('index.html');

    await authenticatedPage.goto('/create', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await expect(authenticatedPage.locator('body')).toContainText(projectName);
    await openProject(authenticatedPage, project);
    await ensureFilesPanelVisible(authenticatedPage);

    await authenticatedPage.getByRole('button', { name: /app\.js/ }).first().click();
    await expect
      .poll(async () => getMonacoValue(authenticatedPage), {
        timeout: 5000,
        message: '重新打开项目后应恢复修改后的次文件',
      })
      .toContain(updatedSecondaryMarker);
  });
});
