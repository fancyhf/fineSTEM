/**
 * fineSTEM E2E 测试 - 项目详情页结题报告
 *
 * 用途：验证项目详情页可导出结题 DOCX，并能生成包含结题重点的报告内容
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
      description: '用于验收展示与结题报告回归测试',
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

test.describe('项目详情页结题报告', () => {
  test('可以导出结题 DOCX，并生成包含结题重点的 final markdown', async ({ authenticatedPage, testUser }) => {
    const timestamp = Date.now();
    const projectName = `结题报告回归_${timestamp}`;
    const project = await createProject(authenticatedPage, testUser.token, projectName);
    const codeMarker = `final-report-marker-${timestamp}`;

    await saveProjectCode(
      authenticatedPage,
      testUser.token,
      project.id,
      `<!DOCTYPE html><html lang="zh-CN"><body><h1>${codeMarker}</h1><p>验收展示回归项目</p></body></html>`,
      'html',
    );

    await authenticatedPage.goto(`/research/projects/${project.id}`);
    await authenticatedPage.waitForLoadState('domcontentloaded');

    await expect(authenticatedPage.locator('body')).toContainText(projectName);
    await expect(authenticatedPage.getByRole('button', { name: '导出结题DOCX' })).toBeVisible();

    await authenticatedPage.getByRole('button', { name: '导出结题DOCX' }).click();

    const docxResponse = await authenticatedPage.request.get(
      `${API_BASE}/projects/${project.id}/export?format=docx`,
      {
        headers: {
          Authorization: `Bearer ${testUser.token}`,
        },
      },
    );
    const disposition = docxResponse.headers()['content-disposition'] ?? '';
    const docxBody = await docxResponse.body();

    expect(docxResponse.ok()).toBeTruthy();
    expect(disposition ?? '').toContain('_final_');
    expect(disposition ?? '').toContain('.docx');
    expect(docxBody.byteLength).toBeGreaterThan(2048);

    const finalMdResponse = await authenticatedPage.request.get(
      `${API_BASE}/documents/projects/${project.id}/generate?document_type=final&format=md`,
      {
        headers: {
          Authorization: `Bearer ${testUser.token}`,
        },
      },
    );

    expect(finalMdResponse.ok()).toBeTruthy();
    const finalMd = await finalMdResponse.text();
    expect(finalMd).toContain(`${projectName} - 结题报告`);
    expect(finalMd).toContain('## 结题重点');
    expect(finalMd).toContain('## 进度摘要');
  });
});
