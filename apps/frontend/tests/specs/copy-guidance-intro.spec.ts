/**
 * fineSTEM E2E 测试 - 复制项目任务引导首次提醒（MVP2 P0-04）
 *
 * 用途：验证 09 文档 AC-03/AC-04/AC-06 的前端接线——
 *   1. 复制项目首次进入 Create 显示提醒，提醒本身不自动发消息；
 *   2. 点"先自己看看"只关横幅、不发消息，快捷区入口仍在；
 *   3. 点"开始任务引导"必须真的发出一条聊天消息（用户气泡出现），
 *      不允许只切场景停在空聊天框（2026-08-16 线上问题回归防护）。
 * 不依赖 ZeroClaw daemon：断言的是发送链路接线（气泡 + copy-guidance 接口），
 * AI 回复质量由 @ai 标记的手测/集成覆盖。
 * 维护者：AI Agent
 * links: .trae/documents/产品与规划/09_fineSTEM_MVP2_Create任务引导_功能与开发说明书_V1.0.md（§9.1 AC-03/04/06）
 */

import type { Page } from '@playwright/test';
import { test, expect, API_BASE } from '../fixtures';

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

interface DemoRecord {
  id: string;
  name: string;
}

interface ProjectRecord {
  id: string;
  name: string;
  mode: string;
}

async function getFirstDemoId(page: Page): Promise<DemoRecord> {
  const response = await page.request.get(`${API_BASE}/demos?page=1&page_size=1`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<{ items: DemoRecord[] }>;
  const demo = body.data.items?.[0];
  expect(demo, '环境里至少要有一个 Demo（种子数据）').toBeTruthy();
  return demo;
}

async function createProjectFromDemo(
  page: Page,
  token: string,
  demoId: string,
  name: string,
): Promise<ProjectRecord> {
  const response = await page.request.post(`${API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, mode: 'light', from_demo_id: demoId },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ApiEnvelope<ProjectRecord>;
  return body.data;
}

async function openProjectInCreate(page: Page, projectName: string) {
  // waitUntil domcontentloaded：dev server 冷编译时 load 事件可能超时
  await page.goto('/create', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const projectItem = page.locator('div.cursor-pointer').filter({ hasText: `📍 ${projectName}` }).first();
  await expect(projectItem).toBeVisible({ timeout: 20000 });
  await projectItem.click();
}

async function waitForCopyGuidanceUpdate(page: Page, projectId: string) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/projects/${projectId}/copy-guidance`) &&
      response.status() === 200,
    { timeout: 15000 },
  );
  return responsePromise;
}

test.describe('复制项目任务引导首次提醒', () => {
  test('AC-03/AC-06：首次进入显示提醒；点击后必须发出聊天消息', async ({ authenticatedPage, testUser }) => {
    const demo = await getFirstDemoId(authenticatedPage);
    const projectName = `复制引导E2E_${Date.now()}`;
    const project = await createProjectFromDemo(authenticatedPage, testUser.token, demo.id, projectName);
    expect(project.mode).toBe('light');

    await openProjectInCreate(authenticatedPage, projectName);

    // AC-03：首次提醒出现（workspace 恢复后）
    const banner = authenticatedPage.locator('text=这是一个从 Demo 复制来的项目');
    await expect(banner).toBeVisible({ timeout: 15000 });
    // 提醒出现时不得自动发消息：此时聊天区不应有任何用户气泡
    await expect(authenticatedPage.getByTestId('message-user')).toHaveCount(0);

    // AC-06：点击"开始任务引导" → 状态接口 200 + 用户气泡必须出现
    const responsePromise = waitForCopyGuidanceUpdate(authenticatedPage, project.id);
    await authenticatedPage.getByRole('button', { name: '开始任务引导' }).click();
    const response = await responsePromise;
    const body = (await response.json()) as ApiEnvelope<{ copy_guidance?: { intro_status?: string } }>;
    expect(body.data.copy_guidance?.intro_status).toBe('started');

    // 2026-08-16 线上问题回归点：点击后聊天区必须出现"开始任务引导"用户气泡
    await expect(banner).toBeHidden();
    await expect(
      authenticatedPage.getByTestId('message-user').filter({ hasText: '开始任务引导' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('AC-04：点"先自己看看"只关横幅不发消息，快捷区入口保留', async ({ authenticatedPage, testUser }) => {
    const demo = await getFirstDemoId(authenticatedPage);
    const projectName = `复制引导关闭E2E_${Date.now()}`;
    const project = await createProjectFromDemo(authenticatedPage, testUser.token, demo.id, projectName);

    await openProjectInCreate(authenticatedPage, projectName);

    const banner = authenticatedPage.locator('text=这是一个从 Demo 复制来的项目');
    await expect(banner).toBeVisible({ timeout: 15000 });

    const responsePromise = waitForCopyGuidanceUpdate(authenticatedPage, project.id);
    await authenticatedPage.getByRole('button', { name: '先自己看看' }).click();
    const response = await responsePromise;
    const body = (await response.json()) as ApiEnvelope<{ copy_guidance?: { intro_status?: string } }>;
    expect(body.data.copy_guidance?.intro_status).toBe('dismissed');

    await expect(banner).toBeHidden();
    // 不发消息：聊天区不得出现任何用户气泡
    await expect(authenticatedPage.getByTestId('message-user')).toHaveCount(0);
    // 快捷区"任务引导"入口仍在（dismissed 不隐藏入口）
    await expect(authenticatedPage.getByRole('button', { name: /^任务引导$/ })).toBeVisible();
  });
});
