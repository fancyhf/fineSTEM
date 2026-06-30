/**
 * fineSTEM E2E 测试 - 共享工具与 fixtures
 *
 * 用途：登录辅助、API 操作、通用断言
 * 维护者：AI Agent
 * links: .trae/documents/testing/
 */

import { existsSync } from 'node:fs';
import { test as base, expect, Page } from '@playwright/test';

const SYSTEM_CHROMIUM_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter((candidate): candidate is string => Boolean(candidate));

const systemChromiumExecutablePath = SYSTEM_CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate));

const API_BASE = process.env.E2E_API_URL;
if (!API_BASE) {
  throw new Error('E2E_API_URL 环境变量未设置，请通过 E2E_API_URL=http://localhost:<PORT>/api/v1 指定后端地址');
}

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
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(explore|dashboard|research)/, { timeout: 15000 }).catch(() => {});
}

export const test = base.extend<{
  testUser: TestUser;
  authenticatedPage: Page;
}>({
  browser: async ({ browser, playwright }, fixtureUse) => {
    if (!systemChromiumExecutablePath) {
      await fixtureUse(browser);
      return;
    }

    const launchedBrowser = await playwright.chromium.launch({
      executablePath: systemChromiumExecutablePath,
      headless: true,
    });

    try {
      await fixtureUse(launchedBrowser);
    } finally {
      await launchedBrowser.close();
    }
  },
  testUser: async ({ page }, fixtureUse) => {
    const user = await registerUser(page, 'auto');
    await fixtureUse(user);
  },
  authenticatedPage: async ({ page, testUser }, fixtureUse) => {
    await loginViaUI(page, testUser.email, testUser.password);
    await fixtureUse(page);
  },
});

export { expect, API_BASE, registerUser, loginViaUI };
