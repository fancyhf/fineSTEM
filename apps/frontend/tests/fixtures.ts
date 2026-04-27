/**
 * fineSTEM E2E 测试 - 共享工具与 fixtures
 *
 * 用途：登录辅助、API 操作、通用断言
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import { test as base, expect, Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:8000/api/v1';

interface TestUser {
  email: string;
  password: string;
  token: string;
  name: string;
  id: string;
}

async function registerUser(page: Page, suffix: string): Promise<TestUser> {
  const email = `e2e_${suffix}_${Date.now()}@finestem.test`;
  const password = 'E2eTest123!';
  const name = `E2E学生${suffix}`;

  const resp = await page.request.post(`${API_BASE}/auth/register`, {
    data: { name, email, password },
  });
  if (!resp.ok()) {
    const text = await resp.text();
    throw new Error(`注册失败 (${resp.status()}): ${text}`);
  }
  const body = await resp.json();
  return {
    email,
    password,
    token: body.data.access_token,
    name: body.data.user.name,
    id: body.data.user.id,
  };
}

async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(explore|dashboard|research)/, { timeout: 15000 }).catch(() => {});
}

export const test = base.extend<{
  testUser: TestUser;
  authenticatedPage: Page;
}>({
  testUser: async ({ page }, use) => {
    const user = await registerUser(page, 'auto');
    await use(user);
  },
  authenticatedPage: async ({ page, testUser }, use) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await use(page);
  },
});

export { expect, API_BASE, registerUser, loginViaUI };
